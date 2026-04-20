import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the home page with AI Resume Matcher branding', () => {
  render(<App />);
  // The Navbar shows the app branding
  expect(screen.getByText(/AI Resume Matcher/i)).toBeInTheDocument();
});
