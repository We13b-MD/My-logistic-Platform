import { Icon } from "@iconify/react";

interface TelegramCommunityWidgetProps {
  channelUrl?: string;
}

export function TelegramCommunityWidget({
  channelUrl = import.meta.env.VITE_TELEGRAM_COMMUNITY_URL || "https://t.me/logistel_community",
}: TelegramCommunityWidgetProps) {
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <a
        href={channelUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Telegram Community"
        title="Telegram Community"
        className="w-12 h-12 rounded-full bg-[#0088cc] hover:bg-[#0077b5] flex items-center justify-center shadow-lg shadow-sky-950/40 hover:scale-110 active:scale-95 transition-all cursor-pointer group"
      >
        <Icon icon="logos:telegram" className="text-2xl drop-shadow-sm group-hover:scale-105 transition-transform" />
      </a>
    </div>
  );
}
