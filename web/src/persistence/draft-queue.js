// Serialize draft writes and flush the newest pending snapshot before navigation.
export class DraftQueue {
  constructor(
    write,
    { delay = 250, onSaved = () => {}, onError = () => {} } = {},
  ) {
    Object.assign(this, { write, delay, onSaved, onError });
    this.pending = null;
    this.timer = null;
    this.tail = Promise.resolve();
  }
  schedule(data, key) {
    clearTimeout(this.timer);
    this.pending = { data, key };
    this.timer = setTimeout(() => this.enqueue(), this.delay);
  }
  enqueue() {
    clearTimeout(this.timer);
    this.timer = null;
    if (!this.pending) return this.tail;
    const { data, key } = this.pending;
    this.pending = null;
    return this.append(data, key);
  }
  append(data, key) {
    const result = this.tail.catch(() => {}).then(() => this.write(data, key));
    this.tail = result;
    // Observe failures without swallowing them: flush must still reject a failed write.
    result.then(
      () => {
        if (this.tail === result && !this.pending) this.onSaved();
      },
      (error) => this.onError(error),
    );
    return result;
  }
  writeNow(data, key) {
    // Save acknowledgements and revision adoption use the same write order as edits.
    this.enqueue();
    return this.append(data, key);
  }
  async flush() {
    await this.enqueue();
  }
}
