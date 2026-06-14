import '../src/index.css';
import { App as Konsta } from 'konsta/react';

/** @type { import('@storybook/react-vite').Preview } */
const preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'ios',
      values: [
        { name: 'ios', value: '#efeff4' },
        { name: 'dark', value: '#000000' },
      ],
    },
  },
  // todos os componentes Cupertino vivem dentro do provider Konsta (tema iOS)
  decorators: [
    (Story) => (
      <Konsta theme="ios">
        <div className="p-4">
          <Story />
        </div>
      </Konsta>
    ),
  ],
};

export default preview;
