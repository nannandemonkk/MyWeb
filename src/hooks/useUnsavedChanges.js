import { useEffect } from "react";

export function useUnsavedChanges(dirty) {
  useEffect(() => {
    if (!dirty) return;
    function warnBeforeUnload(event) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [dirty]);
}
