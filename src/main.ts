import "./reset.css";

import { initializeAudio } from "./audio/audio";
import { initScreen } from "./config";
import { startGame } from "./game";
import { initKeyboard } from "./input/input";
import { initVirtualGamepad } from "./input/touch";

initScreen();
document.defaultView?.addEventListener("resize", initScreen);

initKeyboard();
initVirtualGamepad();

document.addEventListener("visibilitychange", () => {
	if (!document.hidden) {
		initializeAudio();
	}
});

startGame();
