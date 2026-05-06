import { useState } from 'react';
import { ChevronRight, ChevronDown, FileCode, Folder, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TreeNode {
  id: string;
  label: string;
  type: 'folder' | 'file';
  children?: TreeNode[];
  metadata?: any;
}

interface IDATreeViewProps {
  nodes: TreeNode[];
  selectedId?: string;
  onSelect?: (node: TreeNode) => void;
  className?: string;
}

export function IDATreeView({ nodes, selectedId, onSelect, className }: IDATreeViewProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const renderNode = (node: TreeNode, level: number = 0) => {
    const isExpanded = expandedIds.has(node.id);
    const isSelected = selectedId === node.id;
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.id}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                'flex items-center gap-2 h-8 px-2 cursor-pointer text-sm transition-all rounded-md mx-1',
                isSelected
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'hover:bg-muted text-foreground'
              )}
              style={{ paddingLeft: `${level * 16 + 8}px` }}
              onClick={() => {
                if (hasChildren) {
                  toggleExpand(node.id);
                }
                onSelect?.(node);
              }}
            >
              {/* Expand/Collapse Icon */}
              {hasChildren ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpand(node.id);
                  }}
                  className="h-5 w-5 flex items-center justify-center hover:bg-background/20 rounded transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              ) : (
                <div className="h-5 w-5" />
              )}

              {/* Icon */}
              {node.type === 'folder' ? (
                isExpanded ? (
                  <FolderOpen className="h-4 w-4 text-accent flex-shrink-0" />
                ) : (
                  <Folder className="h-4 w-4 text-accent flex-shrink-0" />
                )
              ) : (
                <FileCode className="h-4 w-4 text-primary flex-shrink-0" />
              )}

              {/* Label */}
              <span className="truncate flex-1 font-medium">{node.label}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>{node.label}</p>
          </TooltipContent>
        </Tooltip>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div>
            {node.children!.map(child => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={cn('overflow-auto custom-scrollbar p-1', className)}>
      {nodes.map(node => renderNode(node))}
    </div>
  );
}
