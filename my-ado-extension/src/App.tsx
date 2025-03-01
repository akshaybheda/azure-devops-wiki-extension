import { useEffect, useState } from "react";
import * as SDK from "azure-devops-extension-sdk";
import "./App.css";

function App() {
  const [currUserId, setCurrUserId] = useState<string | null>(null);

  useEffect(() => {
    SDK.init();
    setCurrUserId(SDK.getUser().id);
  }, []);

  return (
    <>
      <h1>
        Hello {SDK.getUser().name} User ID: {currUserId}
      </h1>
    </>
  );
}

export default App;
