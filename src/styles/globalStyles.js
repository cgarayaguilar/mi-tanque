import { createGlobalStyle } from 'styled-components'
import 'styles/normalize.css'

export const GlobalStyle = createGlobalStyle`
  *{ 
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    min-height: 100vh;
    height: 100%;
    width: 100%;
    margin: auto;
    max-width: 600px;
    background: ${({ theme }) => theme.background};
    color: ${({ theme }) => theme.primaryText};
    font-weight: normal;
    font-family: 'Roboto', sans-serif;
  }

  /* Sileo title-cases toast titles; Spanish uses sentence case (§9) */
  [data-sileo-viewport] [data-sileo-title] {
    text-transform: none;
  }

  /* Sileo's description on its light toast is 3.95:1; 0.7 gives 8.6:1 (WCAG AA, §8.11) */
  [data-sileo-viewport][data-theme='dark'] [data-sileo-description] {
    color: rgba(0, 0, 0, 0.7);
  }
`
