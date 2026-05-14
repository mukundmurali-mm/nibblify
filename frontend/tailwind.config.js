export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas:   'rgb(var(--canvas)   / <alpha-value>)',
        surface:  'rgb(var(--surface)  / <alpha-value>)',
        card:     'rgb(var(--card)     / <alpha-value>)',
        muted:    'rgb(var(--muted)    / <alpha-value>)',
        chip:     'rgb(var(--chip)     / <alpha-value>)',
        elevated: 'rgb(var(--elevated) / <alpha-value>)',
        ink: {
          DEFAULT: 'rgb(var(--ink)  / <alpha-value>)',
          2:       'rgb(var(--ink2) / <alpha-value>)',
          3:       'rgb(var(--ink3) / <alpha-value>)',
          4:       'rgb(var(--ink4) / <alpha-value>)',
          5:       'rgb(var(--ink5) / <alpha-value>)',
        },
        edge: {
          DEFAULT: 'rgb(var(--edge)  / <alpha-value>)',
          2:       'rgb(var(--edge2) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
}
