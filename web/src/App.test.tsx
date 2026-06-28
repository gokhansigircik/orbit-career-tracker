import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('Orbit web', () => {
  it('renders hero headline', () => {
    const { container } = render(<App />);
    expect(container.textContent).toContain('developer application tracker serious job hunts deserve');
  });
});
