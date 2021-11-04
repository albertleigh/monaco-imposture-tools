import React from 'react';
import CssBaseline from '@material-ui/core/CssBaseline';
import {DummyEditor} from './editors/DummyEditor';

import './App.css';

const App: React.FC<{}> = () => {
  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
      }}
    >
      <CssBaseline />
      <DummyEditor />
    </div>
  );
};

export default App;
