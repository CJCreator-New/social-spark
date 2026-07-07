type E2EStore = {
  lastGeneratedPosts: number;
  setLastGeneratedPosts: (n: number) => void;
  getLastGeneratedPosts: () => number;
};

const store: E2EStore = {
  lastGeneratedPosts: 0,
  setLastGeneratedPosts(n: number) {
    this.lastGeneratedPosts = Number(n) || 0;
  },
  getLastGeneratedPosts() {
    return this.lastGeneratedPosts;
  },
};

export default store;
