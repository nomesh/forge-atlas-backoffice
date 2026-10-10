import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SidebarNav } from '../components/SidebarNav';

describe('Sidebar Navigation Regression Tests', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders all required backoffice navigation destinations with proper hrefs', () => {
    render(<SidebarNav active="/" />);

    const overviewLink = screen.getByRole('link', { name: /overview/i });
    expect(overviewLink).toHaveAttribute('href', '/');

    const customersLink = screen.getByRole('link', { name: /customers/i });
    expect(customersLink).toHaveAttribute('href', '/customers');

    const provisioningLink = screen.getByRole('link', { name: /provisioning/i });
    expect(provisioningLink).toHaveAttribute('href', '/provisioning');

    const learnStudentsLink = screen.getByRole('link', { name: /learn students/i });
    expect(learnStudentsLink).toHaveAttribute('href', '/learn/students');

    const paymentsLink = screen.getByRole('link', { name: /payment slips/i });
    expect(paymentsLink).toHaveAttribute('href', '/learn/payments');

    const curriculumLink = screen.getByRole('link', { name: /curriculum base/i });
    expect(curriculumLink).toHaveAttribute('href', '/curriculum');

    const auditLink = screen.getByRole('link', { name: /audit log/i });
    expect(auditLink).toHaveAttribute('href', '/audit');
  });

  it('nav items receive click events without runtime exceptions', () => {
    render(<SidebarNav active="/" />);
    const customersLink = screen.getByRole('link', { name: /customers/i });

    expect(() => {
      customersLink.click();
    }).not.toThrow();
  });
});
