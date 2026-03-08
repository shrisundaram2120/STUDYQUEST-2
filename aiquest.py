import gradio as gr
import random
from gpti import bing, gpt

def error_alert(message):
    gr.Warning(message)

with gr.Blocks() as demo:
    gr.Markdown("""AI QUEST
                 Your Ultimate Study Companion.""")
    chatbot = gr.Chatbot()
    radio = gr.Radio(["ChatGPT", "Bing"], value="ChatGPT", label="Select the AI model you want to chat with", info="AI")
    drp = gr.Dropdown(
        interactive=True, choices=["gpt-4", "gpt-3.5-turbo"], value="gpt-4", label="Select Model", info="ChatGPT", visible=True
    )
    msg = gr.Textbox(placeholder="Message", show_label=False)
    clear = gr.ClearButton([msg, chatbot])

    def change_model(req):
        match req.lower():
            case "bing":
                return gr.Dropdown(
                    interactive=True, choices=["Balanced", "Creative", "Precise"], value="Balanced", label="Select Model", info="Bing", visible=True
                )
            case "chatgpt":
                return gr.Dropdown(
                    interactive=True, choices=["gpt-3.5-turbo", "gpt-3.5-turbo"], value="gpt-4", label="Select Model", info="ChatGPT", visible=True
                )
            case _:
                return gr.Dropdown(
                    visible=False
                )

    def user_msg(message, history):
        return "", history + [[message, None]]
    
    def strm_message(history, option, model):
        model_ai = None
        if option.lower() if option is not None else "" and option.lower() in ["chatgpt", "bing"]:
            model_ai = model
        ai_option = option if option is not None else "chatgpt"
        
        messages_history = []
        cnt = 0
        for x in range(len(history)):
            cnt = x
        for user, assistant in list(history):
            if assistant != None:
                messages_history.append({
                    "role": "assistant",
                    "content": assistant
                })
            if user != None:
                messages_history.append({
                    "role": "user",
                    "content": user
                })

        res = None
        if ai_option.lower() == "chatgpt":
            try:
                res = gpt.v1(messages=messages_history, model=model_ai, markdown=False)
    
                if res.error != None:
                    error_alert("The error has occurred. Please try again.")
                    history[cnt][1] = None
                    yield history
                else:
                    res_bot = res.result
                    if res_bot.get("gpt") != None:
                        history[cnt][1] = res_bot.get("gpt")
                        yield history
                    else:
                        error_alert("The error has occurred. Please try again.")
                        history[cnt][1] = None
                        yield history
            except Exception as e:
                error_alert("The error has occurred. Please try again.")
                history[cnt][1] = None
                yield history
        elif ai_option.lower() == "bing":
            try:
                res = bing(messages=messages_history, conversation_style=model_ai, markdown=False, stream=True)
            
                if res.error != None:
                    error_alert("The error has occurred. Please try again.")
                    history[cnt][1] = None
                    yield history
                else:
                    msg_x = None
                    for chunk in res.stream():
                        if chunk.get("error") != None and chunk.get("error") != True and chunk.get("message") != None:
                            msg_x = chunk.get("message")
                            history[cnt][1] = msg_x
                            yield history
                    if msg_x != None:
                        history[cnt][1] = msg_x
                        yield history
                    else:
                        error_alert("The error has occurred. Please try again.")
                        msg_x = None
                        history[cnt][1] = None
                        yield history
            except Exception as e:
                error_alert("The error has occurred. Please try again.")
                history[cnt][1] = None
                yield history
        else:
            error_alert("You haven't selected an AI model to start")
            history[cnt][1] = None
            yield history
        
    radio.change(fn=change_model, inputs=radio, outputs=drp)
    
    msg.submit(user_msg, inputs=[msg, chatbot], outputs=[msg, chatbot], queue=True).then(
        strm_message, [chatbot, radio, drp], chatbot
    )
    

demo.queue()
if __name__ == "__main__":
    demo.launch()