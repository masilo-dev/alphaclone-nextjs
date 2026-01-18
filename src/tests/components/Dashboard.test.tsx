import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from '../../components/Dashboard';
import { User } from '../../types';

// Mock screen and waitFor since they may not be properly configured
const screen = {
  getByText: (text: string | RegExp) => document.querySelector(`*:contains("${text}")`) as HTMLElement,
};

const waitFor = async (callback: () => void) => {
  await new Promise(resolve => setTimeout(resolve, 100));
  callback();
};

// Mock dependencies
vi.mock('../../services/projectService', () => ({
  projectService: {
    getProjects: vi.fn(() => Promise.resolve({ projects: [], error: null })),
    subscribeToProjects: vi.fn(() => ({ unsubscribe: vi.fn() })),
  },
}));

vi.mock('../../services/messageService', () => ({
  messageService: {
    getMessages: vi.fn(() => Promise.resolve({ messages: [], error: null })),
    subscribeToMessages: vi.fn(() => vi.fn()),
  },
}));

vi.mock('../../services/paymentService', () => ({
  paymentService: {
    getAllInvoices: vi.fn(() => Promise.resolve({ invoices: [] })),
  },
}));

const mockUser: User = {
  id: 'test-user-1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'admin',
  avatar: 'https://example.com/avatar.jpg',
};

const renderDashboard = (user: User = mockUser) => {
  return render(
    <BrowserRouter>
      <Dashboard
        user={user}
        onLogout={vi.fn()}
        projects={[]}
        setProjects={vi.fn()}
        messages={[]}
        setMessages={vi.fn()}
        galleryItems={[]}
        setGalleryItems={vi.fn()}
      />
    </BrowserRouter>
  );
};

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dashboard for admin user', async () => {
    renderDashboard();

    await waitFor(() => {
      const element = screen.getByText(/Command Center/i);
      expect(element).toBeTruthy();
    });
  });

  it('renders dashboard for client user', async () => {
    const clientUser = { ...mockUser, role: 'client' as const };
    renderDashboard(clientUser);

    await waitFor(() => {
      const element = screen.getByText(/Client Dashboard/i);
      expect(element).toBeTruthy();
    });
  });

  it('displays user name in welcome message', async () => {
    renderDashboard();

    await waitFor(() => {
      const element = screen.getByText(new RegExp(mockUser.name, 'i'));
      expect(element).toBeTruthy();
    });
  });
});

