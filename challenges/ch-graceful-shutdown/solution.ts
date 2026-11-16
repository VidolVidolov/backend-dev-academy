// @ts-nocheck -- exercise content (student solution / worked reference), not type-checked infra. See CLAUDE.md.
// CHALLENGE: ch-graceful-shutdown — drain in-flight work before exit.
// academy challenge ch-graceful-shutdown   |   academy solve ch-graceful-shutdown

/**
 * Returns { track, drain }.
 * - track(promise): register in-flight work. After drain() is called, track()
 *   must throw (we're shutting down; reject new work).
 * - drain(): resolves once every currently in-flight promise has settled
 *   (fulfilled OR rejected). Calling drain() twice returns the same result.
 *
 * @example
 *   const { track, drain } = createDrainTracker();
 *   track(saveOrder());          // in-flight promise (~50ms)
 *   track(sendEmail());          // another one
 *   const done = drain();        // shutdown begins: no new work accepted
 *   track(anotherJob());         // -> THROWS ("shutting down")
 *   await done;                  // resolves after saveOrder + sendEmail settle
 */
export function createDrainTracker(): { track: (promise: Promise<any>) => Promise<any>; drain: () => Promise<void> } {
  let isSystemShutDown = false;

  const currRequests = new Set();

  const track = (promise) => {
    if (isSystemShutDown) {
      throw new Error("shutting down");
    }

    const p = Promise.resolve(promise).then(
      () => currRequests.delete(p),
      () => currRequests.delete(p),
    );

    currRequests.add(p);

    return promise;
  };

  const drain = async () => {
    isSystemShutDown = true;
    try {
      const results = await Promise.allSettled([...currRequests]);
      const rejected = results.find((item) => item.status === "rejected");
      if (rejected) {
        throw new Error(rejected.reason);
      }
    } catch (error) {
      console.log(error);
      console.log("shutting down");
    }

    console.log("shutting down");
  };

  return { track, drain };
}

// const example = async () => {
//   const saveOrder = () =>
//     new Promise((resolve) =>
//       setTimeout(() => {
//         console.log("order saved");
//         return resolve("order saved");
//       }, 500),
//     );
//   const sendEmail = () =>
//     new Promise((resolve) =>
//       setTimeout(() => {
//         console.log("mail send");
//         return resolve("mail send");
//       }, 500),
//     );
//   const anotherJob = () =>
//     new Promise((resolve) =>
//       setTimeout(() => {
//         console.log("another job");
//         return resolve("another job");
//       }, 500),
//     );
//   const { track, drain } = createDrainTracker();
//   track(saveOrder()); // in-flight promise (~50ms)
//   track(sendEmail()); // another one
//   const done = drain(); // shutdown begins: no new work accepted
//   track(anotherJob()); // -> THROWS ("shutting down")
//   await done; // resolves after saveOrder + sendEmail settle
// };

// example();
