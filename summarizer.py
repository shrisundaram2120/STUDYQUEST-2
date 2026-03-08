import torch
import gradio as gr

# Use a pipeline as a high-level helper
from transformers import pipeline

text_summary = pipeline("summarization", model="sshleifer/distilbart-cnn-12-6",torch_dtype=torch.bfloat16)

# model_path = "../Models/models--sshleifer--distilbart-cnn-12-6/snapshots/a4f8f3ea906ed274767e9906dbaede7531d660ff"
# text_summary = pipeline("summarization", model=model_path, torch_dtype=torch.bfloat16)


# text = ("During that same period, Jobs was heading the most important project in the company’s history. In 1979, he led "
#         "a small group of Apple engineers to a technology demonstration at the Xerox Corporation’s Palo Alto Research "
#         "Center (PARC) to see how the graphical user interface could make computers easier to use and more efficient. "
#         "Soon afterward, Jobs left the engineering team that was designing Lisa, a business computer, "
#         "to head a smaller group building a lower-cost computer. Both computers were redesigned to exploit and refine "
#         "the PARC ideas, but Jobs was explicit in favouring the Macintosh, or Mac, as the new computer became known. "
#         "Jobs coddled his engineers and referred to them as artists, but his style was uncompromising; at one point "
#         "he demanded a redesign of an internal circuit board simply because he considered it unattractive. He would "
#         "later be renowned for his insistence that the Macintosh be not merely great but “insanely great.” In January "
#         "1984 Jobs himself introduced the Macintosh in a brilliantly choreographed demonstration that was the "
#         "centrepiece of an extraordinary publicity campaign. It would later be pointed to as the archetype of “event "
#         "marketing.”")
# print(text_summary(text))

def summary(input_text):
    output = text_summary(input_text)
    return output[0]['summary_text']


gr.close_all()

app = gr.Interface(fn=summary, inputs="text", outputs="text", title="AI QUEST's Text Summarizer.",
                   description="Your ultimate study companion.")
app.launch(share=True)
