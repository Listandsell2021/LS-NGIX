import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

// Only these prefixes are allowed for user-specified commands
const ALLOWED_PREFIXES = [
  'npm run',
  'npm install',
  'npm ci',
  'npx',
  'yarn',
  'pnpm',
  'node',
];

// These characters are NEVER allowed in commands
const DANGEROUS_CHARS = /[;&|`$(){}!<>\\]/;

@ValidatorConstraint({ name: 'isSafeCommand', async: false })
export class IsSafeCommandConstraint implements ValidatorConstraintInterface {
  validate(value: string): boolean {
    if (!value || typeof value !== 'string') return false;

    // Check for dangerous characters (shell metacharacters)
    if (DANGEROUS_CHARS.test(value)) return false;

    // Must start with an allowed prefix
    const hasAllowedPrefix = ALLOWED_PREFIXES.some((prefix) =>
      value.startsWith(prefix),
    );

    return hasAllowedPrefix;
  }

  defaultMessage(): string {
    return `Command must start with one of: ${ALLOWED_PREFIXES.join(', ')}. Shell metacharacters (;, &, |, \`, $, etc.) are not allowed.`;
  }
}

export function IsSafeCommand(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsSafeCommandConstraint,
    });
  };
}
