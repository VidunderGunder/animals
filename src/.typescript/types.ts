export function isEnumValue<E extends Record<string, string | number>>(
	str: unknown,
	enumeration: E,
): str is E[keyof E] {
	return Object.values(enumeration).some((t) => t === str);
}

export function capitalizeTyped<T extends string>(str: T): Capitalize<T> {
	return (str.charAt(0).toUpperCase() + str.slice(1)) as Capitalize<T>;
}

export function uncapitalizeTyped<T extends string>(str: T): Uncapitalize<T> {
	return (str.charAt(0).toLowerCase() + str.slice(1)) as Uncapitalize<T>;
}

export function lowercaseTyped<T extends string>(str: T): Lowercase<T> {
	return str.toLowerCase() as Lowercase<T>;
}

export function uppercaseTyped<T extends string>(str: T): Uppercase<T> {
	return str.toUpperCase() as Uppercase<T>;
}

/**
 * Typed version of Object.keys()
 *
 * A looser implementation than `(keyof T)[]`, using a string suggestion hack:
 *
 * ```ts
 * (keyof T | (string & {}))[]
 * ```
 *
 * Which allows for autocomplete features, without falsely enforcing a strict set of keys
 * (additional properties can always be added to non-constant objects)
 */
export function objectKeys<T extends Record<string, unknown>>(
	obj: T,
	// eslint-disable-next-line @typescript-eslint/ban-types -- Need for hack
): (keyof T | (string & {}))[] {
	return Object.keys(obj);
}

type Separator = " " | "-";

export type Trim<
	T extends string,
	Acc extends string = "",
> = T extends `${infer Char}${infer Rest}`
	? Char extends Separator
		? Trim<Rest, Acc>
		: Trim<Rest, `${Acc}${Char}`>
	: T extends ""
		? Acc
		: never;

/**
 * Removes all spaces from a string
 */
export function trimTyped<T extends string>(str: T): Trim<T> {
	return str.replaceAll(" ", "") as Trim<T>;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type StringWithSuggestions<T extends string> = T | (string & {});
