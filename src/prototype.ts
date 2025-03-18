/*

This is a file where i will prototype and propose new features for the cli tool.

*/

/*
Replacing the worklog sync with a more simple object => pulse;


An undocumented feature of the tempo api is the ability to create "suggestions" in the tempo timesheets by sending pulses, this gives the user a hint of what they worked on in a timesheet without commiting it directly to a worklog.

as it is undocumented i will provide the payload schema:
POST /pulse {
  "source":string,
  "trigger":string,
  "timeStamp":string,
  "groupId":string,
  "searchStrings":[string]
}

note it does not use the /4 prefix


instead of syncing all the logs explicitly we will automatically send a pulse each interval, while we are tracking a branch. it will automatically stop after 8 hours of tracking. Because the workday will be over! And most likely we forgot to stop tracking.


While we are replacing the sync flow with the pulse flow, we will still keep the local logs for reference and not delete the worklogs logic as we might use it in the future.
*/

/**
 * IMPLEMENTATION NOTES
 * 
 * The pulse feature has been implemented with the following components:
 * 
 * 1. API Function (api.ts)
 * -----------------------
 * - Added sendTempoPulse() function that sends pulses to Tempo API
 * - The function uses the undocumented /pulse endpoint (without /4 prefix)
 * - It includes branch name, issue ID, and description in searchStrings
 * 
 * 2. Pulse Sending (commands.ts)
 * ----------------------------
 * - Added startPulseSending() function to begin sending pulses
 * - Added stopPulseSending() function to stop sending pulses
 * - Created sendPulse() function that handles the actual sending
 * - Set up a 5-minute interval for regular pulse updates
 * 
 * 3. Auto-Stop Feature (commands.ts)
 * -------------------------------
 * - Added scheduleAutoStop() function to set up an 8-hour timer
 * - Added cancelAutoStop() function to cancel the timer when tracking stops
 * - The auto-stop feature prevents forgotten tracking sessions
 * 
 * 4. Integration with Existing Code
 * -------------------------------
 * - Modified startTracking() to begin pulse sending and schedule auto-stop
 * - Modified stopTracking() to stop pulse sending and cancel auto-stop
 * - Kept all existing worklog functionality for future use
 * 
 * This implementation maintains all the existing features while adding the
 * pulse functionality to create suggestions in Tempo timesheets without
 * requiring explicit syncing.
 */
