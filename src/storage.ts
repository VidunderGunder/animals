import type { PlayerSaveData } from "./state";

const DB_NAME = "animals-game";
const USERS_STORE = "users";
const SAVES_STORE = "saves";

export type User = {
	id: number;
	name: string;
	createdAt: number;
};

export type Save = {
	id: number;
	userId: number;
	name: string;
	playerData: PlayerSaveData;
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

			// Create users store
			if (!database.objectStoreNames.contains(USERS_STORE)) {
				const usersStore = database.createObjectStore(USERS_STORE, {
					keyPath: "id",
					autoIncrement: true,
				});
				usersStore.createIndex("name", "name", { unique: false });
			}

			// Create saves store
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
		request.onsuccess = () => {
			resolve({ ...user, id: request.result as number });
		};
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

async function createSave(
	userId: number,
	name: string,
	playerData: PlayerSaveData,
): Promise<Save> {
	const database = await openDB();
	return new Promise((resolve, reject) => {
		const tx = database.transaction(SAVES_STORE, "readwrite");
		const store = tx.objectStore(SAVES_STORE);
		const now = Date.now();
		const save: Omit<Save, "id"> = {
			userId,
			name,
			playerData,
			createdAt: now,
			updatedAt: now,
		};
		const request = store.add(save);
		request.onsuccess = () => {
			resolve({ ...save, id: request.result as number });
		};
		request.onerror = () => reject(request.error);
	});
}

async function getSavesForUser(userId: number): Promise<Save[]> {
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

async function getSave(id: number): Promise<Save | null> {
	const database = await openDB();
	return new Promise((resolve, reject) => {
		const tx = database.transaction(SAVES_STORE, "readonly");
		const store = tx.objectStore(SAVES_STORE);
		const request = store.get(id);
		request.onsuccess = () => resolve(request.result ?? null);
		request.onerror = () => reject(request.error);
	});
}

async function updateSave(
	id: number,
	playerData: PlayerSaveData,
): Promise<void> {
	const database = await openDB();
	return new Promise((resolve, reject) => {
		const tx = database.transaction(SAVES_STORE, "readwrite");
		const store = tx.objectStore(SAVES_STORE);
		const getRequest = store.get(id);
		getRequest.onsuccess = () => {
			const save = getRequest.result as Save | undefined;
			if (!save) {
				reject(new Error(`Save with id ${id} not found`));
				return;
			}
			save.playerData = playerData;
			save.updatedAt = Date.now();
			const putRequest = store.put(save);
			putRequest.onsuccess = () => resolve();
			putRequest.onerror = () => reject(putRequest.error);
		};
		getRequest.onerror = () => reject(getRequest.error);
	});
}

// ============ Convenience functions (used by game) ============

/**
 * Initialize storage: ensure at least one user and save exist,
 * then select the first user and first save.
 * Returns the player data from the selected save, or null if new.
 */
export async function initializeStorage(
	defaultPlayerData: PlayerSaveData,
): Promise<PlayerSaveData | null> {
	await openDB();

	// Get or create first user
	let users = await getUsers();
	if (users.length === 0) {
		const newUser = await createUser("Player 1");
		users = [newUser];
	}
	const user = users[0];
	if (!user) throw new Error("No user found after creation.");
	currentUserId = user.id;

	// Get or create first save for this user
	let saves = await getSavesForUser(currentUserId);
	if (saves.length === 0) {
		const newSave = await createSave(
			currentUserId,
			"Save 1",
			defaultPlayerData,
		);
		saves = [newSave];
	}
	const save = saves[0];
	if (!save) throw new Error("No save found after creation.");
	currentSaveId = save.id;

	return save.playerData;
}

/**
 * Save player state to the current save slot.
 * Does nothing if no save is selected.
 */
export async function savePlayerState(data: PlayerSaveData): Promise<void> {
	if (currentSaveId === null) return;
	await updateSave(currentSaveId, data);
}

/**
 * Load player state from the current save slot.
 * Returns null if no save is selected.
 */
export async function loadPlayerState(): Promise<PlayerSaveData | null> {
	if (currentSaveId === null) return null;
	const save = await getSave(currentSaveId);
	return save?.playerData ?? null;
}
