"use client";
import Link from "next/link";
import type { ComponentProps } from "react";
import { useI18n } from "./LanguageProvider";

export default function LocalizedLink(props: ComponentProps<typeof Link>) {
  const { href } = useI18n();
  return <Link {...props} href={typeof props.href === "string" ? href(props.href) : props.href} />;
}
