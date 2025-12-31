import { useEffect, useState } from "react";

interface LoadingScreenProps {
  onComplete: () => void;
}

export const LoadingScreen = ({ onComplete }: LoadingScreenProps) => {
  const messages = ["Connecting to Starlink ", "Pulling Memory Streams "];

  const [text, setText] = useState("");
  const [messageIndex, setMessageIndex] = useState(0);
  const [phase, setPhase] = useState<"typing" | "dots" | "done">("typing");

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (phase === "typing") {
      let index = 0;
      interval = setInterval(() => {
        setText(messages[messageIndex].substring(0, index + 1));
        index++;
        if (index >= messages[messageIndex].length) {
          clearInterval(interval);
          setTimeout(() => {
            setPhase("dots");
          }, 300);
        }
      }, 70);
    }

    return () => clearInterval(interval);
  }, [phase, messageIndex]);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (phase === "dots") {
      let localDotCount = 0;
      interval = setInterval(() => {
        localDotCount++;
        setText((prev) => prev + ".");
        if (localDotCount >= 3) {
          clearInterval(interval);
          if (messageIndex < messages.length - 1) {
            setTimeout(() => {
              setMessageIndex((prev) => prev + 1);
              setText("");
              setPhase("typing");
            }, 500);
          } else {
            setPhase("done");
            setTimeout(onComplete, 800);
          }
        }
      }, 500);

    }

    return () => clearInterval(interval);
  }, [phase, messageIndex, onComplete]);

  return (
    <div className="fixed inset-0 z-50 bg-black text-white flex flex-col items-center justify-center">
      <div className="mb-5 text-xl sm:text-xl md:text-3xl lg:text-4xl font-mono font-bold">
        {text}
        <span className="animate-blink ml-1">|</span>
      </div>

      <div className="w-[200px] h-[2px] bg-gray-800 rounded relative overflow-hidden">
        <div className="w-[40%] h-full bg-blue-500 shadow-[0_0_15px_#3b82f6] animate-loading-bar"></div>
      </div>
    </div>
  );
};
