import mongoose, { Schema, model, models } from 'mongoose'

const PostSchema = new Schema(
  {
    title: {
      fr: { type: String, required: true },
      ar: { type: String, default: '' },
    },
    slug: { type: String, required: true, unique: true },
    excerpt: {
      fr: { type: String, default: '' },
      ar: { type: String, default: '' },
    },
    content: {
      fr: { type: String, required: true },
      ar: { type: String, default: '' },
    },
    image: { type: String, default: '' },
    tags: [{ type: String }],
    isPublished: { type: Boolean, default: false },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

export const Post = models.Post || model('Post', PostSchema)
export type PostDoc = mongoose.InferSchemaType<typeof PostSchema>
