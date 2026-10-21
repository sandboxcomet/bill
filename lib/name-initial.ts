/** Pick a letter for avatars, skipping Thai leading vowels and combining marks. */
export function nameInitial(name: string): string {
  for (const character of name.trim().normalize("NFC")) {
    if (/[ก-ฮ]/u.test(character)) return character;
    if (/\p{L}/u.test(character) && !/[\u0E00-\u0E7F]/u.test(character))
      return character.toUpperCase();
  }
  return Array.from(name.trim())[0] ?? "?";
}
