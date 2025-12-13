/**
 * Utilitaire pour combiner les classes CSS (alternative légère à clsx/tailwind-merge)
 */

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export default cn;
