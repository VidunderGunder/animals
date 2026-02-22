import { cellKey } from "./cells";

export const occupied = new Map<number, string>(); // cellKey -> entityId

export function getOccupant(
	x: number,
	y: number,
	z: number,
): string | undefined {
	return occupied.get(cellKey(x, y, z));
}

export function isOccupied(x: number, y: number, z: number): boolean {
	return occupied.has(cellKey(x, y, z));
}

/**
 * Attempt to occupy a tile for an entity.
 * If different entity already occupies it, returns false and does nothing.
 * If same entity already occupies it, returns true.
 */
export function occupy(props: {
	x: number;
	y: number;
	z: number;
	/**
	 * Entity ID attempting to occupy the tile
	 */
	id: string;
}): boolean {
	const { x, y, z, id: entityId } = props;
	const k = cellKey(x, y, z);
	const curr = occupied.get(k);
	if (curr === undefined || curr === entityId) {
		occupied.set(k, entityId);
		return true;
	}
	return false;
}

/** Vacate a tile if the given entity occupies it. */
export function vacate(
	props:
		| {
				x: number;
				y: number;
				z: number;
				/**
				 * Entity ID attempting to vacate the tile (omit x/y/z to vacate by ID)
				 */
				id?: string;
		  }
		| {
				/**
				 * Entity ID attempting to vacate the tile (omit x/y/z to vacate by ID)
				 */
				id: string;
		  },
): void {
	if (!("x" in props)) {
		vacateByEntityId(props.id);
		return;
	}

	const { x, y, z, id: entityId } = props;
	const k = cellKey(x, y, z);
	if (!occupied.has(k)) return;
	if (!entityId) {
		occupied.delete(k);
		return;
	}
	const curr = occupied.get(k);
	if (curr === entityId) occupied.delete(k);
}

/** Remove any occupancy belonging to this entity (useful on teleport / removal) */
function vacateByEntityId(entityId: string): void {
	for (const [k, id] of occupied.entries()) {
		if (id === entityId) occupied.delete(k);
	}
}

export function swapOccupants(
	a: { x: number; y: number; z: number },
	b: { x: number; y: number; z: number },
	aId: string,
	bId: string,
): boolean {
	const ka = cellKey(a.x, a.y, a.z);
	const kb = cellKey(b.x, b.y, b.z);

	const ca = occupied.get(ka);
	const cb = occupied.get(kb);

	if (ca !== aId) return false;
	if (cb !== bId) return false;

	occupied.set(ka, bId);
	occupied.set(kb, aId);
	return true;
}
