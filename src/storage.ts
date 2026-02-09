// src/storage.ts

import type { BrainState } from "./scenes/overworld/ai/brain";
import { rehydrateBrains } from "./scenes/overworld/ai/brain-registry";
import {
	type Entities,
	type Entity,
	entities,
} from "./scenes/overworld/entities";

const DB_NAME = "animals-game";
const USERS_STORE = "users";
const SAVES_STORE = "saves";

/**
 * Pure-data snapshot of an entity that is safe to persist.
 * Includes render positions (xPx/yPx) so intentional offsets (eg stub landings)
 * survive load.
 */
export type EntitySnapshot = {
	id: string;
	variant: Entity["variant"];
	sheet: Entity["sheet"];

	// tile state
	x: number;
	y: number;
	z: number;

	// render state (may include intentional offsets)
	xPx: number;
	yPx: number;

	// facing + animation state
	direction: Entity["direction"];
	animationCurrent: Entity["animationCurrent"];
	animationFrameIndex: Entity["animationFrameIndex"];

	// misc state you likely want to persist
	moveMode?: Entity["moveMode"];
	interactionLock?: boolean;

	// stable runtime wiring
	brainId?: string | null;
	brainState?: BrainState | null;
};

// Serializable format for IndexedDB (Map can't be stored directly)
type SerializedEntities = [string, EntitySnapshot][];

export type User = {
	id: number;
	name: string;
	createdAt: number;
};

export type SaveSlot = {
	id: number;
	userId: number;
	name: string;
	entitiesData: SerializedEntities;
	createdAt: number;
	updatedAt: number;
};

let db: IDBDatabase | null = null;

// Currently selected user and save (defaults to first of each)
let currentUserId: number | null = null;
let currentSaveId: number | null = null;

function openDB(): Promise<IDBDatabase> {
	if (db) return Promise.resolve(db);

	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME);

		request.onerror = () => reject(request.error);

		request.onsuccess = () => {
			db = request.result;
			resolve(db);
		};

		request.onupgradeneeded = () => {
			const database = request.result;

			if (!database.objectStoreNames.contains(USERS_STORE)) {
				const usersStore = database.createObjectStore(USERS_STORE, {
					keyPath: "id",
					autoIncrement: true,
				});
				usersStore.createIndex("name", "name", { unique: false });
			}

			if (!database.objectStoreNames.contains(SAVES_STORE)) {
				const savesStore = database.createObjectStore(SAVES_STORE, {
					keyPath: "id",
					autoIncrement: true,
				});
				savesStore.createIndex("userId", "userId", { unique: false });
				savesStore.createIndex("name", "name", { unique: false });
			}
		};
	});
}

// ============ User functions ============
async function createUser(name: string): Promise<User> {
	const database = await openDB();
	return new Promise((resolve, reject) => {
		const tx = database.transaction(USERS_STORE, "readwrite");
		const store = tx.objectStore(USERS_STORE);
		const user: Omit<User, "id"> = {
			name,
			createdAt: Date.now(),
		};
		const request = store.add(user);
		request.onsuccess = () => resolve({ ...user, id: Number(request.result) });
		request.onerror = () => reject(request.error);
	});
}

async function getUsers(): Promise<User[]> {
	const database = await openDB();
	return new Promise((resolve, reject) => {
		const tx = database.transaction(USERS_STORE, "readonly");
		const store = tx.objectStore(USERS_STORE);
		const request = store.getAll();
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

// ============ Save functions ============

function toSnapshot(entity: Entity): EntitySnapshot {
	return {
		id: entity.id,
		variant: entity.variant,
		sheet: entity.sheet,

		x: entity.x,
		y: entity.y,
		z: entity.z,

		xPx: entity.xPx,
		yPx: entity.yPx,

		direction: entity.direction,
		animationCurrent: entity.animationCurrent,
		animationFrameIndex: entity.animationFrameIndex,

		moveMode: entity.moveMode,
		interactionLock: entity.interactionLock,

		brainId: entity.brainId ?? null,
		brainState: entity.brainState ?? null,
	};
}

function serializeEntities(map: Entities): SerializedEntities {
	return Array.from(map.entries()).map(([key, entity]) => [
		key,
		toSnapshot(entity),
	]);
}

function deserializeEntities(
	arr: SerializedEntities,
): Map<string, EntitySnapshot> {
	return new Map(arr);
}

async function createSave(
	userId: number,
	name: string,
	entitiesData: Entities,
): Promise<SaveSlot> {
	const database = await openDB();
	return new Promise((resolve, reject) => {
		const tx = database.transaction(SAVES_STORE, "readwrite");
		const store = tx.objectStore(SAVES_STORE);
		const now = Date.now();
		const save: Omit<SaveSlot, "id"> = {
			userId,
			name,
			entitiesData: serializeEntities(entitiesData),
			createdAt: now,
			updatedAt: now,
		};
		const request = store.add(save);
		request.onsuccess = () =>
			resolve({ ...save, id: request.result as number });
		request.onerror = () => reject(request.error);
	});
}

async function getSavesForUser(userId: number): Promise<SaveSlot[]> {
	const database = await openDB();
	return new Promise((resolve, reject) => {
		const tx = database.transaction(SAVES_STORE, "readonly");
		const store = tx.objectStore(SAVES_STORE);
		const index = store.index("userId");
		const request = index.getAll(userId);
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

async function getSave(id: number): Promise<SaveSlot | null> {
	const database = await openDB();
	return new Promise((resolve, reject) => {
		const tx = database.transaction(SAVES_STORE, "readonly");
		const store = tx.objectStore(SAVES_STORE);
		const request = store.get(id);
		request.onsuccess = () => resolve(request.result ?? null);
		request.onerror = () => reject(request.error);
	});
}

async function updateSave(id: number, entitiesData: Entities): Promise<void> {
	const database = await openDB();
	return new Promise((resolve, reject) => {
		const tx = database.transaction(SAVES_STORE, "readwrite");
		const store = tx.objectStore(SAVES_STORE);
		const getRequest = store.get(id);

		getRequest.onsuccess = () => {
			const save = getRequest.result as SaveSlot | undefined;
			if (!save) {
				reject(new Error(`Save with id ${id} not found`));
				return;
			}
			save.entitiesData = serializeEntities(entitiesData);
			save.updatedAt = Date.now();
			const putRequest = store.put(save);
			putRequest.onsuccess = () => resolve();
			putRequest.onerror = () => reject(putRequest.error);
		};

		getRequest.onerror = () => reject(getRequest.error);
	});
}

// ============ Active save selection ============

/**
 * Initialize storage: ensure at least one user and save exist,
 * then select the first user and first save.
 */
export async function selectOrCreateActiveSave(defaultEntitiesData: Entities) {
	await openDB();

	let users = await getUsers();
	if (users.length === 0) {
		const newUser = await createUser("Player 1");
		users = [newUser];
	}
	const user = users[0];
	if (!user) throw new Error("No user found after creation.");
	currentUserId = user.id;

	let saves = await getSavesForUser(currentUserId);
	if (saves.length === 0) {
		const newSave = await createSave(
			currentUserId,
			"Save 1",
			defaultEntitiesData,
		);
		saves = [newSave];
	}
	const save = saves[0];
	if (!save) throw new Error("No save found after creation.");
	currentSaveId = save.id;
}

export async function readActiveSaveSnapshots(): Promise<Map<
	string,
	EntitySnapshot
> | null> {
	if (currentSaveId === null) return null;
	const save = await getSave(currentSaveId);
	return save ? deserializeEntities(save.entitiesData) : null;
}

// ============ Apply snapshots ============

function resetTransientMovement(e: Entity) {
	e.transitionPath = [];
	e.isMoving = false;

	e.xPxi = 0;
	e.yPxi = 0;
	e.zi = e.z;
	e.xPxf = 0;
	e.yPxf = 0;
	e.zf = e.z;

	e.transitionPathSegmentProgress = 0;
	e.transitionPathSegmentDuration = undefined;

	e.transitionEndTile = null;
	e.transitionAnimation = null;

	e.brainDesiredDirection = null;
}

function applySnapshot(live: Entity, snap: EntitySnapshot) {
	// stable wiring
	live.brainId = snap.brainId ?? live.brainId ?? null;
	live.brainState = snap.brainState ?? live.brainState ?? null;

	// core state
	live.x = snap.x;
	live.y = snap.y;
	live.z = snap.z;

	// IMPORTANT: keep persisted render position (may include offsets)
	live.xPx = snap.xPx;
	live.yPx = snap.yPx;

	live.direction = snap.direction;
	live.animationCurrent = snap.animationCurrent;
	live.animationFrameIndex = snap.animationFrameIndex;

	live.moveMode = snap.moveMode ?? live.moveMode;
	live.interactionLock = snap.interactionLock ?? false;

	resetTransientMovement(live);
}

export async function load() {
	// Ensure we have an active save selected
	await selectOrCreateActiveSave(entities);

	const saved = await readActiveSaveSnapshots();
	if (!saved) return;

	// Apply snapshots onto existing runtime entities (created by initializeArea / initEntities).
	// Unknown ids are ignored for now (safe).
	for (const [id, snap] of saved.entries()) {
		const live = entities.get(id);
		if (!live) continue;
		applySnapshot(live, snap);
	}

	// Reattach brains from brainId (only those with brainId set will get brains)
	rehydrateBrains(entities);
}

// ============ Autosave (event-driven + debounced + periodic flush) ============

let dirty = false;
let saveTimer: number | null = null;
let periodicTimer: number | null = null;
let saving = false;

const DEBOUNCE_MS = 500;
const PERIODIC_FLUSH_MS = 30_000;

async function saveNow() {
	if (saving) return; // avoid overlapping IDB transactions
	if (currentSaveId === null) return;

	saving = true;
	try {
		await updateSave(currentSaveId, entities);
		dirty = false;
	} finally {
		saving = false;
	}
}

/**
 * Request autosave. Cheap. Debounced.
 * Call this on meaningful events (eg. player movement completed, pickups, dialog choice).
 */
export function requestAutosave(_reason?: string) {
	dirty = true;

	if (saveTimer !== null) window.clearTimeout(saveTimer);
	saveTimer = window.setTimeout(() => {
		saveTimer = null;
		void saveNow();
	}, DEBOUNCE_MS);
}

/** Force flush (used on hide/page close). */
export async function flushAutosave() {
	if (!dirty) return;
	if (saveTimer !== null) {
		window.clearTimeout(saveTimer);
		saveTimer = null;
	}
	await saveNow();
}

/**
 * Call once during startup (after area/entities initialized).
 * Adds periodic safety flush + flush on hide/pagehide.
 */
export function initAutosave() {
	if (periodicTimer !== null) return;

	periodicTimer = window.setInterval(() => {
		if (!dirty) return;
		void saveNow();
	}, PERIODIC_FLUSH_MS);

	document.addEventListener("visibilitychange", () => {
		if (document.hidden) void flushAutosave();
	});

	window.addEventListener("pagehide", () => {
		void flushAutosave();
	});
}
