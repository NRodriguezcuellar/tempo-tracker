import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

type Tab = {
  id: string;
  label: string;
  content: React.ReactNode;
};

const Tabs = ({
  activeTab,
  tabs,
  onTabChange,
}: {
  activeTab: string;
  tabs: Tab[];
  onTabChange: (id: string) => void;
}) => {
  useInput((_, key) => {
    if (key.leftArrow) {
      const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);
      const newIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      onTabChange(tabs[newIndex].id);
    }

    if (key.rightArrow) {
      const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);
      const newIndex = (currentIndex + 1) % tabs.length;
      onTabChange(tabs[newIndex].id);
    }
  });

  return (
    <Box flexDirection="column" width="100%">
      <Box flexDirection="row">
        {tabs.map((tab) => (
          <Box
            key={tab.id}
            marginRight={1}
            paddingX={2}
            borderStyle="single"
            borderColor={tab.id === activeTab ? "green" : "gray"}
            borderTop={true}
            borderLeft={true}
            borderRight={true}
            paddingBottom={0}
            marginBottom={0}
            borderBottom={true}
            justifyContent="flex-start"
          >
            <Text
              bold={tab.id === activeTab}
              color={tab.id === activeTab ? "green" : "white"}
            >
              {tab.label}
            </Text>
          </Box>
        ))}
      </Box>
      <Box
        borderStyle="single"
        borderColor="green"
        padding={1}
        minHeight={10}
        borderTop={true}
      >
        {tabs.find((tab) => tab.id === activeTab)?.content}
      </Box>
    </Box>
  );
};

const App = () => {
  const [activeTab, setActiveTab] = useState("tab1");

  const tabs: Tab[] = [
    {
      id: "tab1",
      label: "Tab 1",
      content: <Text>Content for Tab 1</Text>,
    },
    {
      id: "tab2",
      label: "Tab 2",
      content: <Text>Content for Tab 2</Text>,
    },
    {
      id: "tab3",
      label: "Tab 3",
      content: <Text>Content for Tab 3</Text>,
    },
  ];

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="green">
        Tempo Tracker
      </Text>
      <Tabs activeTab={activeTab} tabs={tabs} onTabChange={setActiveTab} />
      <Box marginTop={1}>
        <Text color="gray">Use ← → arrow keys to navigate between tabs</Text>
      </Box>
    </Box>
  );
};

export default App;
