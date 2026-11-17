import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { InboxPage } from '../features/inbox/InboxPage';
import { CasesPage } from '../features/cases/CasesPage';
import { CaseWorkspacePage } from '../features/cases/CaseWorkspacePage';
import { EscalationsPage } from '../features/escalation/EscalationsPage';
import { TasksPage } from '../features/tasks/TasksPage';
import { ReportsPage } from '../features/reports/ReportsPage';
import { ChannelsPage } from '../features/channels/ChannelsPage';
import { AccessControlPage } from '../features/access-control/AccessControlPage';
import { NotFoundPage } from './NotFoundPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="inbox" element={<InboxPage />} />
          <Route path="inbox/:conversationId" element={<InboxPage />} />
          <Route path="cases" element={<CasesPage />} />
          <Route path="cases/:caseId" element={<CaseWorkspacePage />} />
          <Route path="escalations" element={<EscalationsPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="admin/channels" element={<ChannelsPage />} />
          <Route path="admin/access" element={<AccessControlPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
