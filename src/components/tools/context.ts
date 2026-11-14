import { createContext, useContext } from "react";
import type { ToolId } from "../ui";

/** Opens a comfort tool in the shared bottom sheet (provided by the tabs layout). */
export const ToolsContext = createContext<{ openTool: (t: ToolId) => void }>({ openTool: () => {} });
export const useTools = () => useContext(ToolsContext);
