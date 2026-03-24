import { useState } from 'react';
import { Menu, Bell, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HeaderProps {
  title: string;
  onMenuToggle: () => void;
}

export function Header({ title, onMenuToggle }: HeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-surface-200 bg-white/80 px-4 backdrop-blur-sm sm:px-6">
      {/* Left: hamburger + title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="rounded-lg p-2 text-surface-500 hover:bg-surface-100 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <h1 className="text-lg font-semibold text-surface-900">{title}</h1>
      </div>

      {/* Right: search, notifications */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div
          className={cn(
            'flex items-center overflow-hidden rounded-lg border border-surface-200 bg-surface-50 transition-all duration-200',
            searchOpen ? 'w-56' : 'w-9',
          )}
        >
          <button
            onClick={() => setSearchOpen((prev) => !prev)}
            className="flex h-9 w-9 shrink-0 items-center justify-center text-surface-400 hover:text-surface-600"
          >
            <Search className="h-4 w-4" />
          </button>
          {searchOpen && (
            <input
              type="text"
              placeholder="Buscar..."
              autoFocus
              onBlur={() => setSearchOpen(false)}
              className="h-9 w-full bg-transparent pr-3 text-sm text-surface-900 outline-none placeholder:text-surface-400"
            />
          )}
        </div>

        {/* Notifications */}
        <button className="relative rounded-lg p-2 text-surface-500 hover:bg-surface-100">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent-500" />
        </button>
      </div>
    </header>
  );
}
