import { ThemeProvider, ToastProvider } from '@astrabound/duality';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router';

import { AppShell } from './components/AppShell.tsx';
import { RequireAuth } from './components/RequireAuth.tsx';
import { BacklogPage } from './routes/BacklogPage.tsx';
import { BoardPage } from './routes/BoardPage.tsx';
import { LoginPage } from './routes/LoginPage.tsx';
import { MatrixPage } from './routes/MatrixPage.tsx';
import { NotFoundPage } from './routes/NotFoundPage.tsx';
import { ProjectDetailPage } from './routes/ProjectDetailPage.tsx';
import { ProjectsPage } from './routes/ProjectsPage.tsx';
import { SettingsPage } from './routes/SettingsPage.tsx';
import { TaskDetailPage } from './routes/TaskDetailPage.tsx';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Neon's free tier meters compute, so nothing polls on a timer.
      refetchOnWindowFocus: true,
      refetchInterval: false,
      staleTime: 30_000,
      retry: 1,
    },
  },
});

export function App() {
  return (
    <ThemeProvider storageKey="atlas-theme">
      <QueryClientProvider client={queryClient}>
        <ToastProvider placement="bottom-end" max={3}>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<RequireAuth />}>
                <Route element={<AppShell />}>
                  <Route index element={<BacklogPage />} />
                  <Route path="tasks/:id" element={<TaskDetailPage />} />
                  <Route path="board" element={<BoardPage />} />
                  <Route path="matrix" element={<MatrixPage />} />
                  <Route path="projects" element={<ProjectsPage />} />
                  <Route path="projects/:id" element={<ProjectDetailPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Route>
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
