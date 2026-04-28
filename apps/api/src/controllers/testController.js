import { testService } from "../services/testServices.js";

export const helloWorld = async (req, res, next) => {
    try {
        const helloWorld = await testService.fetchHello();

        res.status(200).json({message: helloWorld});
    } catch (error) {
        next(error);
    }
};

export const postHelloWorld = async (req, res, next) => {
    try {
        const {message} = req.body;

        if (!message) {
            return res.status(400).json({ error: "Message is required" });
        }

        const newMessage = await testService.createHello({message});

        res.status(201).json({message: "Hello World insert successfull", id: newMessage.id})
        
    } catch (error) {
        next(error);
    }
}

export const getHelloById = async (req, res, next) => {
    try {
        const {id} = req.params;

        const result = await testService.fetchHelloById(id);

        res.status(200).json({result: result})

    } catch (error) {
        next(error);
    }
}