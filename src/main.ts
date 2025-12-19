import "./reset.css";

import { startGame } from "./game";
import { initKeyboard } from "./input/input";
import { initVirtualGamepad } from "./input/touch";

initKeyboard();
initVirtualGamepad();
startGame();
