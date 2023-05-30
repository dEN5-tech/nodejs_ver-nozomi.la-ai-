class TagInfo {
    constructor() {
      this.name = '';
      this.display = '';
      this.type = '';
      this.n_responses = {};
      for (const response of ALL_RESPONSES) {
        this.n_responses[response] = 0;
      }
    }
  
    parseTag(tag) {
      this.name = tag.name;
      this.display = tag.display;
      this.type = tag.type;
    }
  
    toString() {
      return `<tag ${this.name} ${this.type} ${JSON.stringify(this.n_responses)}>`;
    }
  
    sum() {
      return Object.values(this.n_responses).reduce((sum, value) => sum + value, 0);
    }
  }

  