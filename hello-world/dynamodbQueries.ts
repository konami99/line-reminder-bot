import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient, UpdateItemCommand, QueryCommand, Select, UpdateItemCommandInput, GetItemCommand, GetItemCommandInput, GetItemCommandOutput } from "@aws-sdk/client-dynamodb";
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

  static async getReminder(pk: string, sk: string): Promise<GetItemCommandOutput> {
    const params: GetItemCommandInput = {
      TableName: 'line-reminders',
      Key: {
        pk: { 'S': pk },
        sk: { 'S': sk },
      },
    }

    const getClient = new DynamoDBClient({
      region: 'us-west-2' as string,
    });
    const reminder = await getClient.send(new GetItemCommand(params))
    return reminder;
  }

  static async scheduledReminders(userId: string): Promise<QueryCommandOutput> {
    const queryItemParams = {
      TableName: 'line-reminders',
      IndexName: 'gsi1pk-gsi1sk-index',
      KeyConditionExpression: 'gsi1pk = :gsi1pk AND gsi1sk = :gsi1sk',
      ExpressionAttributeValues: {
        ':gsi1pk': { 'S': `UR#${userId}` },
        ':gsi1sk': { 'S': 'scheduled' },
      },
    };

    const getClient = new DynamoDBClient({
      region: 'us-west-2' as string,
    });
    const scheduledReminders = await getClient.send(new QueryCommand(queryItemParams))
    return scheduledReminders;
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
    const params: UpdateItemCommandInput = {
      TableName: 'line-reminders',
      Key: {
        pk: { 'S': `USER#${userId}` },
        sk: { 'S': `USER#${userId}` },
      },
      UpdateExpression: 'SET scheduled_reminders_count = scheduled_reminders_count + :inc',
      ExpressionAttributeValues: {
        ':inc': { 'N': incrementBy.toString() },
      },
    };

    const client = new DynamoDBClient({
      region: 'us-west-2' as string,
    });

    await client.send(new UpdateItemCommand(params))
  }
}