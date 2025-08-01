import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import commentRoutes from './routes/commentRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/comments', commentRoutes);

// Listen server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

