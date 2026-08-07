import {
  Avatar,
  Box,
  Button,
  Divider,
  Drawer,
  DrawerBody,
  DrawerHeader,
  Heading,
  Icon,
  Inline,
  Kbd,
  Popover,
  SideNav,
  Sidebar,
  SidebarBody,
  SidebarFooter,
  SidebarHeader,
  SidebarTrigger,
  Stack,
  Text,
} from '@astrabound/duality';
import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';

import { ACTION_ICONS } from '../lib/icons.ts';
import { NAV_ITEMS, activeNavPath } from '../lib/nav.ts';
import { IconLabel } from './IconLabel.tsx';
import { QuickAddContext } from '../lib/quick-add.ts';
import { useLogout, useSession } from '../lib/session.ts';
import { useIsMobile } from '../lib/useIsMobile.ts';
import { BrandMark } from './BrandMark.tsx';
import { CommandBar } from './CommandBar.tsx';
import { QuickAddModal } from './QuickAddModal.tsx';

/** True while the user is typing, so bare-letter shortcuts stay out of the way. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

// Persist the sidebar collapse the same way Duality persists the theme: a small
// localStorage flag, read once on mount and written whenever it changes.
const NAV_COLLAPSED_KEY = 'atlas-nav-collapsed';

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: user } = useSession();
  const logout = useLogout();
  const isMobile = useIsMobile();

  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddProjectId, setQuickAddProjectId] = useState<string | undefined>(undefined);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const openQuickAdd = useCallback((projectId?: string) => {
    setQuickAddProjectId(projectId);
    setQuickAddOpen(true);
  }, []);

  // Duality's own SidebarTrigger only works inside <Sidebar>, and a 64px rail is
  // no place for it, so the sidebar is controlled from here instead.
  const [navCollapsed, setNavCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(NAV_COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(NAV_COLLAPSED_KEY, String(navCollapsed));
    } catch {
      // Ignore storage failures (e.g. private mode); state still works in-session.
    }
  }, [navCollapsed]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }

      if (event.key === 'n' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        if (isTyping(event.target)) return;
        event.preventDefault();
        setQuickAddProjectId(undefined);
        setQuickAddOpen(true);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const navItems = NAV_ITEMS.map((item) => ({
    id: item.path,
    label: item.label,
    icon: <item.Icon aria-hidden />,
    onSelect: () => {
      setNavOpen(false);
      void navigate(item.path);
    },
  }));

  const accountMenu = (
    <Popover
      placement="bottom-end"
      open={accountOpen}
      onOpenChange={setAccountOpen}
      trigger={
        <Button variant="ghost" size="sm" aria-label="Account menu">
          <Inline gap={2} align="center">
            <Avatar name={user?.displayName} size="sm" />
            {!isMobile ? <Text size="sm">{user?.displayName}</Text> : null}
          </Inline>
        </Button>
      }
    >
      <Stack gap={2} style={{ minWidth: 200 }}>
        <Stack gap={0}>
          <Text size="sm" weight="bold">
            {user?.displayName}
          </Text>
          <Text size="sm">{user?.username}</Text>
        </Stack>
        <Divider />
        <Stack gap={1}>
          <Button
            className="atlas-button atlas-account-item"
            variant="ghost"
            size="md"
            onClick={() => {
              setAccountOpen(false);
              void navigate('/settings');
            }}
          >
            <IconLabel icon={ACTION_ICONS.settings}>Settings</IconLabel>
          </Button>
          <Button
            className="atlas-button atlas-account-item"
            variant="ghost"
            size="md"
            onClick={() => {
              setAccountOpen(false);
              logout.mutate();
            }}
          >
            <IconLabel icon={ACTION_ICONS.signOut}>Sign out</IconLabel>
          </Button>
        </Stack>
      </Stack>
    </Popover>
  );

  const searchButton = isMobile ? (
    <Button
      className="atlas-quick-actions-button"
      variant="ghost"
      size="sm"
      aria-label="Search"
      onClick={() => setPaletteOpen(true)}
    >
      <Icon icon={ACTION_ICONS.search} />
    </Button>
  ) : (
    <Button
      className="atlas-quick-actions-button"
      variant="ghost"
      size="sm"
      onClick={() => setPaletteOpen(true)}
    >
      <Inline gap={2} align="center">
        <span>Search</span>
        <Kbd>Ctrl</Kbd>
        <Kbd>K</Kbd>
      </Inline>
    </Button>
  );

  return (
    <Inline className="atlas-shell" gap={0} align="stretch" wrap={false}>
      <a className="atlas-skip-link" href="#main-content">
        Skip to content
      </a>

      {!isMobile ? (
        <Sidebar aria-label="Main" collapsed={navCollapsed} onCollapsedChange={setNavCollapsed}>
          <SidebarHeader>
            <Inline
              gap={2}
              align="center"
              justify={navCollapsed ? 'center' : 'start'}
              wrap={false}
              style={{ flex: 1, minWidth: 0 }}
            >
              <BrandMark size={24} />
              {!navCollapsed && (
                <Heading level={2} visualLevel={5}>
                  Atlas
                </Heading>
              )}
            </Inline>
          </SidebarHeader>
          <SidebarBody>
            <SideNav
              aria-label="Sections"
              collapsed={navCollapsed}
              activeId={activeNavPath(location.pathname)}
              items={navItems}
            />
          </SidebarBody>
          <SidebarFooter>
            <Inline
              justify={navCollapsed ? 'center' : 'end'}
              wrap={false}
              style={{ width: '100%' }}
            >
              <SidebarTrigger />
            </Inline>
          </SidebarFooter>
        </Sidebar>
      ) : null}

      <Box style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <Box as="header" className="atlas-header" paddingX={5} paddingY={3}>
          <Inline
            className="atlas-header-row"
            gap={3}
            align="center"
            justify={isMobile ? 'between' : 'end'}
            wrap={false}
          >
            {isMobile ? (
              <Inline gap={2} align="center" wrap={false} style={{ minWidth: 0 }}>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Open navigation"
                  onClick={() => setNavOpen(true)}
                >
                  <Icon icon={ACTION_ICONS.menu} />
                </Button>
                <BrandMark size={22} />
                <Heading level={2} visualLevel={5}>
                  Atlas
                </Heading>
              </Inline>
            ) : null}

            <Inline gap={3} align="center" wrap={false}>
              {searchButton}
              {accountMenu}
            </Inline>
          </Inline>
        </Box>

        <Box
          as="main"
          id="main-content"
          className="atlas-main"
          tabIndex={-1}
          paddingX={5}
          paddingY={5}
          style={{ flex: 1, minWidth: 0, minHeight: 0 }}
        >
          <QuickAddContext.Provider value={openQuickAdd}>
            <Outlet />
          </QuickAddContext.Provider>
        </Box>
      </Box>

      {isMobile ? (
        <Drawer
          className="atlas-nav-drawer"
          side="start"
          size="sm"
          isOpen={navOpen}
          onClose={() => setNavOpen(false)}
          showCloseButton
          aria-label="Main navigation"
        >
          <DrawerHeader>
            <Inline gap={2} align="center">
              <BrandMark size={24} />
              <Heading level={2} visualLevel={5}>
                Atlas
              </Heading>
            </Inline>
          </DrawerHeader>
          <DrawerBody>
            <SideNav
              aria-label="Sections"
              activeId={activeNavPath(location.pathname)}
              items={navItems}
            />
          </DrawerBody>
        </Drawer>
      ) : null}

      {quickAddOpen ? (
        <QuickAddModal
          initialProjectId={quickAddProjectId}
          onClose={() => setQuickAddOpen(false)}
        />
      ) : null}

      <CommandBar
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onQuickAdd={openQuickAdd}
      />
    </Inline>
  );
}
