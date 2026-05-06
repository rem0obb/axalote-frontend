import { ReactNode } from 'react';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { DockablePanel } from './DockablePanel';

interface IDALayoutProps {
  leftPanel?: ReactNode;
  centerTopPanel?: ReactNode;
  centerBottomPanel?: ReactNode;
  rightPanel?: ReactNode;
  bottomPanel?: ReactNode;
}

export function IDALayout({
  leftPanel,
  centerTopPanel,
  centerBottomPanel,
  rightPanel,
  bottomPanel,
}: IDALayoutProps) {
  return (
    <div className="h-screen w-screen bg-background overflow-hidden flex flex-col">
      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Left Panel - Navigation/Tree */}
          {leftPanel && (
            <>
              <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
                {leftPanel}
              </ResizablePanel>
              <ResizableHandle className="w-[1px] bg-border hover:bg-primary/50 transition-colors" />
            </>
          )}

          {/* Center Panels - Main Content */}
          <ResizablePanel defaultSize={55} minSize={30}>
            <ResizablePanelGroup direction="vertical">
              {/* Center Top - Hex/Code Viewer */}
              {centerTopPanel && (
                <>
                  <ResizablePanel defaultSize={60} minSize={30}>
                    {centerTopPanel}
                  </ResizablePanel>
                  <ResizableHandle className="h-[1px] bg-border hover:bg-primary/50 transition-colors" />
                </>
              )}

              {/* Center Bottom - Strings/IOCs/Behavior */}
              {centerBottomPanel && (
                <ResizablePanel defaultSize={40} minSize={20}>
                  {centerBottomPanel}
                </ResizablePanel>
              )}
            </ResizablePanelGroup>
          </ResizablePanel>

          {/* Right Panel - Metadata/Stats */}
          {rightPanel && (
            <>
              <ResizableHandle className="w-[1px] bg-border hover:bg-primary/50 transition-colors" />
              <ResizablePanel defaultSize={25} minSize={15} maxSize={35}>
                {rightPanel}
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>

      {/* Bottom Panel - Terminal/Logs (Optional) */}
      {bottomPanel && (
        <>
          <div className="h-[1px] bg-border" />
          <div className="h-48 overflow-hidden">
            {bottomPanel}
          </div>
        </>
      )}
    </div>
  );
}
