import { ConnectButton } from "@rainbow-me/rainbowkit";
import { FaGithub } from "react-icons/fa";

export default function Header() {
  return (
    <header className="flex items-center justify-between p-4 border-b border-gray-200">
      {/* Left side - Title */}
      <div className="flex items-center space-x-4">
        <h1 className="text-xl font-bold">tsender</h1>
      </div>

      {/* Right side - GitHub link and Connect button */}
      <div className="flex items-center space-x-4">
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <FaGithub size={24} />
        </a>
        <ConnectButton />
      </div>
    </header>
  );
}