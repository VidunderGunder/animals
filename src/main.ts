import "./reset.css";

import { initializeAudio } from "./audio/audio";
import { startGame } from "./game";
import { initKeyboard } from "./input/input";
import { initVirtualGamepad } from "./input/touch";

initKeyboard();
initVirtualGamepad();

document.addEventListener("visibilitychange", () => {
	if (!document.hidden) {
		initializeAudio();
	}
});

startGame();
