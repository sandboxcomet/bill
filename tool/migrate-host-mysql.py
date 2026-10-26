#!/usr/bin/env python3
"""One-time, non-destructive container-to-host cutover during the CI rollout."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from urllib.parse import unquote, urlsplit


def runtime_values(path):
    result = {}
    for line in Path(path).read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key, value = line.split("=", 1)
            result[key.strip()] = value.strip().strip("\"'")
    return result


def run(command, *, data=None, env=None):
    result = subprocess.run(command, input=data, env=env, capture_output=True)
    if result.returncode:
        # SQL errors can include row contents. Never print stdout/stderr here.
        raise RuntimeError(f"{command[0]} operation failed (exit {result.returncode})")
    return result.stdout


def inspect(name):
    return json.loads(run(["docker", "inspect", name]))[0]


def endpoint(value):
    parsed = urlsplit(value)
    host = parsed.hostname
    if host in ("host.docker.internal", "172.17.0.1", "127.0.0.1"):
        host = "host"
    return host, parsed.port or 3306, parsed.path


def fingerprint(query, database):
    tables = query("SELECT TABLE_NAME FROM information_schema.TABLES "
                   f"WHERE TABLE_SCHEMA='{database}' AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME").decode().splitlines()
    result = {}
    for table in tables:
        quoted = "`" + table.replace("`", "``") + "`"
        literal = table.replace("'", "''")
        columns = query("SELECT COLUMN_NAME FROM information_schema.COLUMNS "
                        f"WHERE TABLE_SCHEMA='{database}' AND TABLE_NAME='{literal}' ORDER BY ORDINAL_POSITION").decode().splitlines()
        fields = []
        for column in columns:
            name = "`" + column.replace("`", "``") + "`"
            fields.append(f"IF({name} IS NULL,'N',CONCAT('V',HEX(CAST({name} AS BINARY))))")
        # Hash every column, preserving NULL/empty distinctions and duplicate
        # rows. Sort row hashes independently of indexes/physical row order.
        rows = query("SET time_zone='+00:00'; SELECT SHA2(CONCAT_WS(CHAR(58),"
                     + ",".join(fields) + f"),256) FROM `{database}`.{quoted}").splitlines()
        result[table] = {"rows": len(rows), "sha256": hashlib.sha256(b"\n".join(sorted(rows))).hexdigest()}
    return result


def migrate(env_file):
    values = runtime_values(env_file)
    source = values.get("BILL_DB_IMPORT_FROM_CONTAINER", "")
    if not source:
        print("No container database import requested.")
        return
    if source != "wonglao-bill-database":
        raise RuntimeError("Unexpected import container")
    url = urlsplit(values["DATABASE_URL"])
    if (url.scheme != "mysql" or url.hostname != "host.docker.internal" or
            url.path != "/wonglao_bill" or not url.username or not url.password):
        raise RuntimeError("Import must target the host wonglao_bill database")
    app = inspect("wonglao-bill")
    existing = dict(entry.split("=", 1) for entry in app["Config"].get("Env", []) if "=" in entry)
    if endpoint(existing.get("DATABASE_URL", "")) == endpoint(values["DATABASE_URL"]):
        print("Application already uses the host database; no data imported.")
        return
    old = urlsplit(existing.get("DATABASE_URL", ""))
    if old.scheme != "mysql" or old.hostname != "database" or old.path != "/wonglao_bill":
        raise RuntimeError("Application is not using the expected container database")
    db = inspect(source)
    if db["State"]["Status"] != "running":
        raise RuntimeError("Source database is not running")
    target_env = dict(os.environ, MYSQL_PWD=unquote(url.password))
    target_command = ["mysql", "--protocol=TCP", "--host=127.0.0.1", f"--port={url.port or 3306}",
                      f"--user={unquote(url.username)}", "--default-character-set=utf8mb4", "--batch", "--skip-column-names"]

    def target(sql):
        return run(target_command + ["--execute", sql], env=target_env)

    def source_query(sql):
        return run(["docker", "exec", source, "sh", "-c",
                    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -u root --default-character-set=utf8mb4 --batch --skip-column-names --execute "$1"',
                    "sh", sql])

    if target("SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='wonglao_bill'").strip() != b"1":
        raise RuntimeError("Create the empty host database before importing")
    if target("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='wonglao_bill'").strip() != b"0":
        raise RuntimeError("Target contains tables; refusing to overwrite existing data")
    if source_query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='wonglao_bill' "
                    "AND (TABLE_TYPE <> 'BASE TABLE' OR ENGINE <> 'InnoDB')").strip() != b"0":
        raise RuntimeError("This import requires InnoDB base tables")
    for kind, field in [("ROUTINES", "ROUTINE_SCHEMA"), ("EVENTS", "EVENT_SCHEMA"), ("TRIGGERS", "TRIGGER_SCHEMA")]:
        if source_query(f"SELECT COUNT(*) FROM information_schema.{kind} WHERE {field}='wonglao_bill'").strip() != b"0":
            raise RuntimeError("Stored objects need a separately reviewed migration")
    was_running = app["State"]["Status"] == "running"
    try:
        # Drain/stop the only writer, keeping its container for rollback.
        if was_running:
            run(["docker", "stop", "--time", "30", "wonglao-bill"])
        before = fingerprint(source_query, "wonglao_bill")
        dump = run(["docker", "exec", source, "sh", "-c",
                    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -u root --single-transaction --quick '
                    '--skip-add-drop-table --skip-add-drop-trigger --skip-add-locks --skip-disable-keys '
                    '--no-tablespaces --set-gtid-purged=OFF --hex-blob --skip-comments --column-statistics=0 '
                    '--default-character-set=utf8mb4 wonglao_bill'])
        if re.search(rb"(?im)^\s*(?:/\*!\d+\s*)?(?:DROP|TRUNCATE|DELETE|REPLACE)\s", dump):
            raise RuntimeError("Refusing destructive SQL in the transfer")
        # The dump is transferred in memory; no backup/SQL file is created.
        run(target_command + ["wonglao_bill"], data=dump, env=target_env)
        after = fingerprint(target, "wonglao_bill")
        if before != after or before != fingerprint(source_query, "wonglao_bill"):
            raise RuntimeError("Source/target row counts or content hashes differ")
        print(json.dumps({"database_import": "verified", "source_container": db["Id"],
                          "target": "host MySQL/wonglao_bill", "tables": after}, sort_keys=True))
    except Exception:
        if was_running:
            run(["docker", "start", "wonglao-bill"])
        raise


if __name__ == "__main__":
    try:
        migrate(sys.argv[1])
    except Exception as error:
        print(f"Host database import stopped: {error}", file=sys.stderr)
        sys.exit(1)
