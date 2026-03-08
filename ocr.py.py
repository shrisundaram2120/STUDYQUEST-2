import gradio as gr
import tensorflow as tf
import keras_ocr
import requests
import cv2
import os
import csv
import numpy as np
import pandas as pd
import huggingface_hub
from huggingface_hub import Repository
from datetime import datetime
import scipy.ndimage.interpolation as inter
import easyocr
import datasets
from datasets import load_dataset, Image
from PIL import Image
from paddleocr import PaddleOCR
from save_data import flag
            
"""
Paddle OCR
"""
def ocr_with_paddle(img):
    finaltext = ''
    ocr = PaddleOCR(lang='en', use_angle_cls=True)
    # img_path = 'exp.jpeg'
    result = ocr.ocr(img)
    
    for i in range(len(result[0])):
        text = result[0][i][1][0]
        finaltext += ' '+ text
    return finaltext

"""
Keras OCR
"""
def ocr_with_keras(img):
    output_text = ''
    pipeline=keras_ocr.pipeline.Pipeline()
    images=[keras_ocr.tools.read(img)]
    predictions=pipeline.recognize(images)
    first=predictions[0]
    for text,box in first:
        output_text += ' '+ text
    return output_text

"""
easy OCR
"""
# gray scale image
def get_grayscale(image):
    return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

# Thresholding or Binarization
def thresholding(src):
    return cv2.threshold(src,127,255, cv2.THRESH_TOZERO)[1]
def ocr_with_easy(img):
    gray_scale_image=get_grayscale(img)
    thresholding(gray_scale_image)
    cv2.imwrite('image.png',gray_scale_image)
    reader = easyocr.Reader(['th','en'])
    bounds = reader.readtext('image.png',paragraph="False",detail = 0)
    bounds = ''.join(bounds)
    return bounds
        
"""
Generate OCR
"""
def generate_ocr(Method,img):
    
    text_output = ''
    if (img).any():
        add_csv = []
        image_id = 1
        print("Method___________________",Method)
        if Method == 'EasyOCR':
            text_output = ocr_with_easy(img)
        if Method == 'KerasOCR':
            text_output = ocr_with_keras(img)
        if Method == 'PaddleOCR':
            text_output = ocr_with_paddle(img)
       
        try:
            flag(Method,text_output,img)
        except Exception as e:
            print(e)
        return text_output
    else:
        raise gr.Error("Please upload an image!!!!")
    
    # except Exception as e:
    #     print("Error in ocr generation ==>",e)
    #     text_output = "Something went wrong"
    # return text_output
    

"""
Create user interface for OCR demo
"""

# image = gr.Image(shape=(300, 300))
image = gr.Image()
method = gr.Radio(["PaddleOCR","EasyOCR", "KerasOCR"],value="PaddleOCR")
output = gr.Textbox(label="Output")

demo = gr.Interface(
    generate_ocr,
    [method,image],
    output,
    title="Optical Character Recognition",
    css=".gradio-container {background-color: lightgray} #radio_div {background-color: #FFD8B4; font-size: 40px;}",
    article = """<p style='text-align: center;'>Presented by the team of STUDY QUEST. 
                                    your ultimate study companion"""
    

)
# demo.launch(enable_queue = False)
demo.launch()
