import { Volume2 } from "lucide-react";

import { IconButton } from "../../../shared/ui";
import { useSpeech } from "../lib/useSpeech";
export function SpeechButton({
  text,
  label = "Прослушать",
}: {
  text: string;
  label?: string;
}) {
  const { speak, enabled, supported, speechError } = useSpeech();
  return (
    <span className="speech-wrap">
      <IconButton
        className="speech-button"
        type="button"
        aria-label={label}
        title={!supported ? "Браузер не поддерживает озвучивание" : label}
        disabled={!enabled}
        onClick={() => speak(text)}
      >
        <Volume2 size={20} />
      </IconButton>
      {speechError && (
        <span role="status" className="speech-error">
          {speechError}
        </span>
      )}
    </span>
  );
}
