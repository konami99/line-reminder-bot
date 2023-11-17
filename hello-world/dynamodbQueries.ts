import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient, UpdateItemCommand, QueryCommand, Select } from "@aws-sdk/client-dynamodb";
import { Client } from "@upstash/qstash";
import { DateTime } from "luxon";
import {
  ClientConfig,
  MessageAPIResponseBase,
  messagingApi,
  middleware,
  MiddlewareConfig,
  webhook,
} from '@line/bot-sdk';
import { DynamoDBDocumentClient, GetCommand, GetCommandInput, GetCommandOutput, PutCommand, PutCommandInput, QueryCommandOutput, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ulid } from "ulid"

export class DynamoDBCRUDs {
  static async insertUser(userId: string) {

    const client = new DynamoDBClient({
      region: 'us-west-2' as string,
    });
    const dbDocClient = DynamoDBDocumentClient.from(client);
    const created_at = parseInt(new Date().getTime().toString())

    const params: PutCommandInput = {
      TableName: 'line-reminders',
      Item: {
        pk: `USER#${userId}`,
        sk: `USER#${userId}`,
        created_at,
        scheduled_reminders_count: 0
      },
      ConditionExpression: "attribute_not_exists(PK)"
    }

    const data = await dbDocClient.send(new PutCommand(params))
  }

  static async getUser(userId: string): Promise<GetCommandOutput> {
    const client = new DynamoDBClient({
      region: 'us-west-2' as string,
    });
    const dbDocClient = DynamoDBDocumentClient.from(client);

    const params: GetCommandInput = {
      TableName: 'line-reminders',
      Key: {
        pk: `USER#${userId}`,
        sk: `USER#${userId}`
      }
    }

    const data = await dbDocClient.send(new GetCommand(params));
    return data;
  }

  static async insertReminder(userId: string, reminderId: string, message: string, scheduled_at: number) {
    const client = new DynamoDBClient({
      region: 'us-west-2' as string,
    });
    const dbDocClient = DynamoDBDocumentClient.from(client);
    const created_at = parseInt(new Date().getTime().toString())

    const params: PutCommandInput = {
      TableName: 'line-reminders',
      Item: {
        pk: `UR#${userId}`,
        sk: `REMINDER#${reminderId}`,
        gsi1pk: `UR#${userId}`,
        gsi1sk: 'scheduled',
        message,
        scheduled_at,
        created_at,
      },
    }

    const data = await dbDocClient.send(new PutCommand(params))
  }

  static async scheduledRemindersCount(userId: string): Promise<QueryCommandOutput> {
    const queryItemParams = {
      TableName: 'line-reminders',
      IndexName: 'gsi1pk-gsi1sk-index', // Replace with your GSI name
      KeyConditionExpression: 'gsi1pk = :gsi1pk AND gsi1sk = :gsi1sk', // Define your conditions
      ExpressionAttributeValues: {
        ':gsi1pk': { 'S': `UR#${userId}` },
        ':gsi1sk': { 'S': 'scheduled' }, // Replace with the status value you're querying
      },
      Select: Select.COUNT
    };

    const getClient = new DynamoDBClient({
      region: 'us-west-2' as string,
    });
    //const dbDocClient = DynamoDBDocumentClient.from(client);
    //const data = await dbDocClient.send(new UpdateCommand(params));
    const numberOfItems = await getClient.send(new QueryCommand(queryItemParams))
    return numberOfItems;
  }

  static async updateReminderStatus(userId: string, reminderId: string, status: string) {
    const params = {
      TableName: 'line-reminders',
      Key: {
        pk: { 'S': `UR#${userId}` },
        sk: { 'S': `REMINDER#${reminderId}` },
      },
      UpdateExpression: 'SET #status = :newStatus',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':newStatus': { 'S': status },
      },
    };

    const client = new DynamoDBClient({
      region: 'us-west-2' as string,
    });

    await client.send(new UpdateItemCommand(params))
  }

  static async updateUserRemindersCount(userId: string, incrementBy: number) {

  }
}