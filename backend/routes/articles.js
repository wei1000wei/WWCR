const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Article = require('../models/Article');

// HTML转义函数，防止XSS攻击
const escapeHtml = (text) => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

// @route    GET api/articles
// @desc     Get all articles
// @access   Public
router.get('/', async (req, res) => {
  try {
    const { category, tag, search, page = 1, limit = 10 } = req.query;
    
    let query = {
      status: 'published'
    };
    
    // Filter by category
    if (category) {
      query.category = category;
    }
    
    // Filter by tag
    if (tag) {
      query.tags = tag;
    }
    
    // Search by title or content
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Calculate skip for pagination
    const skip = (page - 1) * limit;
    
    // Get articles with pagination
    const articles = await Article.find(query)
      .populate('author', 'username')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));
    
    // Get total count
    const total = await Article.countDocuments(query);
    
    res.json({
      articles,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        current: Number(page)
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    GET api/articles/:id
// @desc     Get article by ID
// @access   Public
router.get('/:id', async (req, res) => {
  try {
    const article = await Article.findById(req.params.id)
      .populate('author', 'username')
      .populate('comments.user', 'username');
    
    if (!article) {
      return res.status(404).json({ msg: '文章不存在' });
    }
    
    // Increment view count
    article.viewCount += 1;
    await article.save();
    
    res.json(article);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    POST api/articles
// @desc     Create a new article
// @access   Private
router.post('/', auth, async (req, res) => {
  try {
    const { title, content, summary, category, tags, status } = req.body;
    
    // Validate input
    if (!title || !content) {
      return res.status(400).json({ msg: '标题和内容不能为空' });
    }
    
    // Create article
    const article = new Article({
      title: escapeHtml(title),
      content: content,
      summary: summary ? escapeHtml(summary) : undefined,
      author: req.user.id,
      category: category || '未分类',
      tags: tags || [],
      status: status || 'published'
    });
    
    await article.save();
    
    // Populate author info
    const populatedArticle = await Article.findById(article.id)
      .populate('author', 'username');
    
    res.json(populatedArticle);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    PUT api/articles/:id
// @desc     Update an article
// @access   Private (only author or admin)
router.put('/:id', auth, async (req, res) => {
  try {
    const { title, content, summary, category, tags, status } = req.body;
    
    // Find article
    const article = await Article.findById(req.params.id);
    if (!article) {
      return res.status(404).json({ msg: '文章不存在' });
    }
    
    // Check if user is author or admin
    if (article.author.toString() !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'owner') {
      return res.status(403).json({ msg: '没有权限修改此文章' });
    }
    
    // Update article
    article.title = title ? escapeHtml(title) : article.title;
    article.content = content ? content : article.content;
    article.summary = summary ? escapeHtml(summary) : article.summary;
    article.category = category ? category : article.category;
    article.tags = tags ? tags : article.tags;
    article.status = status ? status : article.status;
    
    await article.save();
    
    // Populate author info
    const populatedArticle = await Article.findById(article.id)
      .populate('author', 'username');
    
    res.json(populatedArticle);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    DELETE api/articles/:id
// @desc     Delete an article
// @access   Private (only author or admin)
router.delete('/:id', auth, async (req, res) => {
  try {
    // Find article
    const article = await Article.findById(req.params.id);
    if (!article) {
      return res.status(404).json({ msg: '文章不存在' });
    }
    
    // Check if user is author or admin
    if (article.author.toString() !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'owner') {
      return res.status(403).json({ msg: '没有权限删除此文章' });
    }
    
    // Delete article
    await Article.findByIdAndDelete(req.params.id);
    
    res.json({ msg: '文章已删除' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    POST api/articles/:id/comment
// @desc     Add a comment to an article
// @access   Private
router.post('/:id/comment', auth, async (req, res) => {
  try {
    const { content } = req.body;
    
    // Find article
    const article = await Article.findById(req.params.id);
    if (!article) {
      return res.status(404).json({ msg: '文章不存在' });
    }
    
    // Validate input
    if (!content) {
      return res.status(400).json({ msg: '评论内容不能为空' });
    }
    
    // Add comment
    const comment = {
      user: req.user.id,
      content: escapeHtml(content)
    };
    
    article.comments.push(comment);
    await article.save();
    
    // Populate user info in comments
    const updatedArticle = await Article.findById(req.params.id)
      .populate('author', 'username')
      .populate('comments.user', 'username');
    
    res.json(updatedArticle);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    GET api/articles/categories
// @desc     Get all categories
// @access   Public
router.get('/categories/list', async (req, res) => {
  try {
    const categories = await Article.distinct('category');
    res.json(categories);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    GET api/articles/tags
// @desc     Get all tags
// @access   Public
router.get('/tags/list', async (req, res) => {
  try {
    const articles = await Article.find({ status: 'published' });
    const tags = new Set();
    
    articles.forEach(article => {
      article.tags.forEach(tag => {
        tags.add(tag);
      });
    });
    
    res.json(Array.from(tags));
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;