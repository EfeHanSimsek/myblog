import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import authRoutes from './routes/auth.js';
import postRoutes from './routes/posts.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'API çalışıyor', data: { uptime: process.uptime() } });
});

app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use(notFound);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Blog API http://localhost:${port} adresinde çalışıyor`);
});
