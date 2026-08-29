/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        whatsapp: {
          green: '#00a884',
          teal: '#128c7e',
          light: '#25d366',
          bg: '#f0f2f5',
          chat: '#efeae2',
        }
      }
    },
  },
  plugins: [],
}
