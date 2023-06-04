function full_path_from_hash(hash) {
    if (hash.length < 3) {
      return hash;
    }
    return hash.replace(/^.*(..)(.)$/, '$2/$1/' + hash);
  }
  
  class Tag {
    constructor(name, display, type) {
      this.name = name;
      this.display = display;
      this.type = type;
    }
  }
  
  class DocNotSuitable extends Error {}
  
  class Doc {
    constructor(json) {
      this.response = null;
      this.tags = [];
      this.img_urls = [];
      this.local_filenames = [];
      
      if (json !== null) {
        this.parse(json)
      }
    }
  
    parse(json) {
      for (const tagType of ['general', 'character', 'artist']) {
        for (const item of json[tagType] || []) {
          this.tags.push(new Tag(item.tag, item.tagname_display, item.tagtype));
        }
      }
      if (this.tags.length === 0) {
        throw new DocNotSuitable();
      }
      for (const item of json.imageurls) {
        if (!item.is_video) {
          const image_url =
            '//' +
            (json.type === 'gif' ? 'g' : 'w') +
            '.nozomi.la/' +
            full_path_from_hash(json.dataid) +
            '.' +
            (json.type === 'gif' ? 'gif' : 'webp');
          this.img_urls.push('https:' + image_url);
        }
      }
      if (this.img_urls.length === 0) {
        throw new DocNotSuitable();
      }
      this.id = String(json.postid);
      this.img_type = json.type;
      this.width = json.width;
      this.height = json.height;
      this.date = json.date;
    }
  
    getArtists() {
      return this.tags
        .filter((x) => x.type === 'artist')
        .map((x) => x.display);
    }
  
    getTags() {
      return this.tags
        .filter((x) => x.type === 'general')
        .map((x) => x.display);
    }
  
    toString() {
      return `<doc ${this.id} ${this.response} ${this.local_filenames.length > 0 ? 'saved' : ''}>`;
    }
  }




module.exports={
  Doc,
  Tag,
  full_path_from_hash
}