"use client";

import * as d3 from 'd3';
import { HierarchyPointNode } from 'd3';
import { useEffect, useRef } from 'react';

interface MCTSNode {
  node_id: string;
  parent_id: string | null;
  state: string;
  visits: number;
  value: number;
  action_taken: string | null;
}

interface MCTSVisualizationProps {
  nodes: MCTSNode[];
  width?: number;
  height?: number;
}

export function MCTSVisualization({ nodes: nodeData, width = 600, height = 400 }: MCTSVisualizationProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || nodeData.length === 0) return;

    // Clear previous visualization
    d3.select(svgRef.current).selectAll('*').remove();

    // Create hierarchical data
    const stratify = d3.stratify<MCTSNode>()
      .id(d => d.node_id)
      .parentId(d => d.parent_id);

    const root = stratify(nodeData);
    if (!root) return;

    // Create tree layout
    const treeLayout = d3.tree<MCTSNode>()
      .size([height - 40, width - 160]);

    const tree = treeLayout(root);

    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', 'translate(80,20)');

    // Add links
    svg.selectAll('path')
      .data(tree.links())
      .join('path')
      .attr('d', d3.linkHorizontal<d3.HierarchyLink<MCTSNode>, d3.HierarchyPointNode<MCTSNode>>()
        .x(d => d.y)
        .y(d => d.x)
      )
      .attr('fill', 'none')
      .attr('stroke', '#999')
      .attr('stroke-width', 1.5);

    // Add nodes
    const nodes = svg.selectAll<SVGGElement, HierarchyPointNode<MCTSNode>>('g')
      .data(tree.descendants())
      .join('g')
      .attr('transform', d => `translate(${d.y},${d.x})`);

    // Node circles
    nodes.append('circle')
      .attr('r', d => Math.max(4, Math.min(8, d.data.visits / 2)))
      .attr('fill', d => d3.interpolateRdYlBu(d.data.value))
      .attr('stroke', '#666')
      .attr('stroke-width', 1.5);

    // Node labels
    nodes.append('text')
      .attr('dy', '0.31em')
      .attr('x', d => d.children ? -6 : 6)
      .attr('text-anchor', d => d.children ? 'end' : 'start')
      .text(d => d.data.action_taken || 'root')
      .clone(true).lower()
      .attr('stroke', 'white')
      .attr('stroke-width', 3);

  }, [nodeData, width, height]);

  return (
    <div className="relative w-full h-full overflow-hidden">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
} 