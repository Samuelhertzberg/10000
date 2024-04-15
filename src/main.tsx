import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './main.css'
import { createTheme } from '@mui/material';
import { ThemeProvider } from '@emotion/react';
import Color from 'color';

const basePrimary = '#ffffff'
const baseSecondary = '#000000'
const baseSuccess = '#00B300'
const baseError = '#ff0000'

const brightnessFactor = 0.3

const theme = createTheme({
  palette: {
    primary: {
      main: basePrimary,
      dark: Color(basePrimary).darken(brightnessFactor).hex(),
      light: Color(basePrimary).lighten(brightnessFactor).hex(),
    },
    secondary: {
      main: baseSecondary,
      dark: Color(baseSecondary).darken(brightnessFactor).hex(),
      light: Color(baseSecondary).lighten(brightnessFactor).hex(),
    },
    success: {
      main: baseSuccess,
      dark: Color(baseSuccess).darken(brightnessFactor).hex(),
      light: Color(baseSuccess).lighten(brightnessFactor).hex(),
    },
    error: {
      main: baseError,
      dark: Color(baseError).darken(brightnessFactor).hex(),
      light: Color(baseError).lighten(brightnessFactor).hex(),
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)
