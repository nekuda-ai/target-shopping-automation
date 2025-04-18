import { Stagehand } from '@browserbasehq/stagehand';
import dotenv from 'dotenv';
import { sendRunStarted, sendItemAdded, sendItemFailed, sendCartReady, sendError, sendCheckoutComplete, sendCheckoutFailed, sendCheckoutInitiated } from './slack';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

// Load environment variables
dotenv.config();

// Define types for shopping items and run states
export type ShoppingItem = {
  name: string;
  quantity: number;
  url?: string;
};

export type RunState = 'pending' | 'running' | 'cart_ready' | 'checkout_started' | 'checkout_complete' | 'checkout_failed';

// In-memory storage for run data
type RunData = {
  id: string;
  items: ShoppingItem[];
  status: RunState;
  timestamp: number;
  sessionId?: string;
  successCount: number;
};

const runs: Record<string, RunData> = {};

// Helper function to simulate delay for development/testing
const simulateDelay = (min: number, max: number): Promise<void> => {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
};

// Helper function to get a random failure reason for simulation
const getRandomFailureReason = (): string => {
  const reasons = [
    'Item out of stock',
    'Could not find exact product match',
    'Price has increased significantly',
    'Product page did not load correctly',
    'Add to cart button not found'
  ];
  return reasons[Math.floor(Math.random() * reasons.length)];
};

// Create a new shopping run
export function createRun(items: ShoppingItem[]): string {
  const runId = `run_${Date.now().toString(16)}`;
  runs[runId] = {
    id: runId,
    items,
    status: 'pending',
    timestamp: Date.now(),
    successCount: 0
  };
  console.log(`Created run ${runId} with ${items.length} items`);
  return runId;
}

// Update a run's status
export function updateRunStatus(runId: string, status: RunState): boolean {
  if (!runs[runId]) {
    console.error(`Run ${runId} not found`);
    return false;
  }
  
  runs[runId].status = status;
  return true;
}

// Update a run's browser session ID
export function updateRunSessionId(runId: string, sessionId: string): boolean {
  if (!runs[runId]) {
    console.error(`Run ${runId} not found`);
    return false;
  }
  
  runs[runId].sessionId = sessionId;
  return true;
}

// Update a run's success count
export function updateRunSuccessCount(runId: string, count: number): boolean {
  if (!runs[runId]) {
    console.error(`Run ${runId} not found`);
    return false;
  }
  
  runs[runId].successCount = count;
  return true;
}

// Get a run's data
export function getRun(runId: string): RunData | null {
  return runs[runId] || null;
}

// Process a shopping run with Stagehand automation
export async function processShoppingList(
  runId: string,
  items: ShoppingItem[]
): Promise<boolean> {
  console.log(`Starting automation for run ${runId} with ${items.length} items`);
  
  // Attempt to send a Slack notification, but continue processing regardless
  await sendRunStarted(runId, items.length);
  
  // Update run status to running
  updateRunStatus(runId, 'running');

  // For now, we'll simulate the browser automation
  // In the real implementation, this would use Stagehand with BrowserBase
  // Implementation depends on final Stagehand API
  try {
    console.log("Simulating browser automation with Stagehand");
    
    // Generate a session ID
    const sessionId = uuidv4();
    updateRunSessionId(runId, sessionId);
    console.log(`Started Browser session for run ${runId}: ${sessionId}`);
    
    // Process each item
    let successCount = 0;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      // Simulate processing delay
      await simulateDelay(1000, 3000);
      console.log(`Processing item ${i+1}/${items.length}: ${item.name}`);
      
      // Simulate success/failure (80% success rate)
      const isSuccess = Math.random() < 0.8;
      
      if (isSuccess) {
        // Update counters
        successCount++;
        updateRunSuccessCount(runId, successCount);
        console.log(`Added "${item.name}" to cart (${i+1}/${items.length})`);
        
        // Send notification
        await sendItemAdded(runId, item.name, i + 1, items.length);
      } else {
        // Generate random failure reason
        const reason = getRandomFailureReason();
        console.error(`Failed to add "${item.name}" to cart: ${reason}`);
        
        // Send failure notification
        await sendItemFailed(runId, item.name, reason);
      }
    }
    
    // Update run status to cart_ready
    updateRunStatus(runId, 'cart_ready');
    console.log(`Updated run ${runId} status to: cart_ready`);
    
    // Send completion notification
    await sendCartReady(runId, successCount, items.length);
    
    return successCount > 0;
  } catch (error) {
    console.error(`Error in shopping automation for run ${runId}:`, error);
    
    // Update run status and notify
    updateRunStatus(runId, 'cart_ready'); // Mark as ready but with failures
    const errorMessage = error instanceof Error ? error.message : 'Unknown automation error';
    await sendError(runId, errorMessage);
    
    return false;
  }
}

// Process checkout for a shopping run
export async function processCheckout(runId: string): Promise<boolean> {
  console.log(`Starting checkout for run ${runId}`);
  
  // Update run status
  updateRunStatus(runId, 'checkout_started');
  console.log(`Updated run ${runId} status to: checkout_started`);
  await sendCheckoutInitiated(runId);

  // For now, we'll simulate the checkout process
  // In the real implementation, this would use Stagehand with BrowserBase
  try {
    // Simulate checkout process
    await simulateDelay(3000, 8000);
    console.log("Simulating checkout process with Stagehand");
    
    // Generate a random order total
    const total = `$${(Math.random() * 100 + 20).toFixed(2)}`;
    console.log(`Order ready for final confirmation. Total: ${total}`);
    
    // Simulate final checkout step
    await simulateDelay(2000, 5000);
    
    // Simulate success (90% success rate)
    const isSuccess = Math.random() < 0.9;
    
    if (isSuccess) {
      // Generate a random order number
      const orderNumber = `ORD-${Math.floor(Math.random() * 10000000)}`;
      
      // Update status
      updateRunStatus(runId, 'checkout_complete');
      console.log(`Updated run ${runId} status to: checkout_complete`);
      
      // Send success notification
      await sendCheckoutComplete(runId);
      
      return true;
    } else {
      // Update status and notify
      updateRunStatus(runId, 'checkout_failed');
      console.log(`Updated run ${runId} status to: checkout_failed`);
      
      const errorMessage = 'Checkout failed: ' + getRandomFailureReason();
      await sendCheckoutFailed(runId, errorMessage);
      
      return false;
    }
  } catch (error) {
    console.error(`Error in checkout process for run ${runId}:`, error);
    
    // Update status and notify
    updateRunStatus(runId, 'checkout_failed');
    console.log(`Updated run ${runId} status to: checkout_failed`);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown checkout error';
    await sendError(runId, errorMessage);
    
    return false;
  }
}
